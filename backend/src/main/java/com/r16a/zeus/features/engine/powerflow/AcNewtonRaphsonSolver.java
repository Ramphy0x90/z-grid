package com.r16a.zeus.features.engine.powerflow;

import com.r16a.zeus.features.engine.powerflow.AcPowerFlowInput.BranchEdge;
import com.r16a.zeus.features.engine.powerflow.AcPowerFlowInput.BusCategory;
import com.r16a.zeus.features.engine.powerflow.AcPowerFlowInput.BusNode;
import com.r16a.zeus.features.simulation.exception.PowerFlowCalculationException;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class AcNewtonRaphsonSolver {

    public AcPowerFlowResult solve(AcPowerFlowInput input, AcPowerFlowOptions options) {
        int nBus = input.buses().size();
        YBusModel yBus = buildYBus(input);

        double[] vm = new double[nBus];
        double[] va = new double[nBus];
        List<Integer> slack = new ArrayList<>();
        List<Integer> pv = new ArrayList<>();
        List<Integer> pq = new ArrayList<>();

        for (int i = 0; i < nBus; i++) {
            BusNode bus = input.buses().get(i);
            vm[i] = bus.busType() == BusCategory.PV ? bus.voltageSetpointPu() : bus.voltageMagnitudeInitPu();
            va[i] = Math.toRadians(bus.voltageAngleInitDeg());
            if (bus.busType() == BusCategory.SLACK) {
                slack.add(i);
            } else if (bus.busType() == BusCategory.PV) {
                pv.add(i);
            } else {
                pq.add(i);
            }
        }

        if (slack.size() != 1) {
            throw new PowerFlowCalculationException("Expected exactly one slack bus during solve.");
        }

        List<Integer> pEquationBuses = new ArrayList<>(pv.size() + pq.size());
        pEquationBuses.addAll(pv);
        pEquationBuses.addAll(pq);

        boolean converged = false;
        int iteration = 0;
        double[][] lastPower = computePower(nBus, vm, va, yBus.g, yBus.b);

        for (iteration = 1; iteration <= options.maxIterations(); iteration++) {
            double[] mismatch = buildMismatch(input, pEquationBuses, pq, lastPower);
            double maxAbsMismatch = maxAbs(mismatch);
            if (maxAbsMismatch < options.tolerance()) {
                converged = true;
                break;
            }

            double[][] jacobian = buildJacobian(input, pEquationBuses, pq, vm, va, lastPower, yBus.g, yBus.b);
            double[] correction = solveLinearSystem(jacobian, mismatch);

            int angleCount = pEquationBuses.size();
            for (int i = 0; i < angleCount; i++) {
                int busIdx = pEquationBuses.get(i);
                va[busIdx] += correction[i];
            }
            for (int i = 0; i < pq.size(); i++) {
                int busIdx = pq.get(i);
                vm[busIdx] += correction[angleCount + i];
                vm[busIdx] = Math.max(0.5, Math.min(1.5, vm[busIdx]));
            }

            lastPower = computePower(nBus, vm, va, yBus.g, yBus.b);
        }

        if (!converged) {
            throw new PowerFlowCalculationException(
                    "Power flow did not converge in " + options.maxIterations() + " iterations."
            );
        }

        return buildResult(input, iteration - 1, vm, va, yBus);
    }

    private AcPowerFlowResult buildResult(
            AcPowerFlowInput input,
            int iterations,
            double[] vm,
            double[] va,
            YBusModel yBus
    ) {
        List<AcPowerFlowResult.BusState> busStates = new ArrayList<>();
        List<AcPowerFlowResult.VoltageViolation> voltageViolations = new ArrayList<>();

        for (int i = 0; i < input.buses().size(); i++) {
            BusNode bus = input.buses().get(i);
            double vmBus = vm[i];
            double vaDeg = Math.toDegrees(va[i]);
            busStates.add(new AcPowerFlowResult.BusState(bus.busId(), bus.busName(), vmBus, vaDeg));
            if (vmBus < bus.minVoltagePu() || vmBus > bus.maxVoltagePu()) {
                voltageViolations.add(new AcPowerFlowResult.VoltageViolation(
                        bus.busId(),
                        bus.busName(),
                        vmBus,
                        bus.minVoltagePu(),
                        bus.maxVoltagePu()
                ));
            }
        }

        List<ComplexNumber> voltages = new ArrayList<>(input.buses().size());
        for (int i = 0; i < input.buses().size(); i++) {
            voltages.add(polar(vm[i], va[i]));
        }

        double totalLoadMw = input.buses().stream()
                .mapToDouble(bus -> Math.max(0.0, -bus.pSpecPu()) * input.baseMva())
                .sum();
        double totalGenerationMw = input.buses().stream()
                .mapToDouble(bus -> Math.max(0.0, bus.pSpecPu()) * input.baseMva())
                .sum();

        List<AcPowerFlowResult.BranchFlow> branchFlows = new ArrayList<>();
        List<AcPowerFlowResult.ThermalViolation> thermalViolations = new ArrayList<>();
        double totalLossesMw = 0.0;
        for (BranchEdge branch : input.branches()) {
            ComplexNumber vf = voltages.get(branch.fromIndex());
            ComplexNumber vt = voltages.get(branch.toIndex());

            ComplexNumber ySeries = new ComplexNumber(branch.resistancePu(), branch.reactancePu());
            double den = ySeries.re() * ySeries.re() + ySeries.im() * ySeries.im();
            if (den < 1e-12) {
                continue;
            }
            ySeries = new ComplexNumber(ySeries.re() / den, -ySeries.im() / den);
            ComplexNumber yShuntHalf = new ComplexNumber(0.0, branch.shuntSusceptancePu() / 2.0);
            ComplexNumber tap = polar(branch.tapRatio(), Math.toRadians(branch.phaseShiftDeg()));
            ComplexNumber tapConj = tap.conjugate();
            ComplexNumber tapNorm = tap.multiply(tapConj);

            ComplexNumber yff = ySeries.add(yShuntHalf).divide(tapNorm);
            ComplexNumber yft = ySeries.multiply(-1.0).divide(tapConj);
            ComplexNumber ytf = ySeries.multiply(-1.0).divide(tap);
            ComplexNumber ytt = ySeries.add(yShuntHalf);

            ComplexNumber ifrom = yff.multiply(vf).add(yft.multiply(vt));
            ComplexNumber ito = ytf.multiply(vf).add(ytt.multiply(vt));

            ComplexNumber sFrom = vf.multiply(ifrom.conjugate()).multiply(input.baseMva());
            ComplexNumber sTo = vt.multiply(ito.conjugate()).multiply(input.baseMva());

            double sFromMva = sFrom.magnitude();
            double sToMva = sTo.magnitude();
            double maxEndMva = Math.max(sFromMva, sToMva);
            double loadingPercent = branch.ratingMva() > 1e-9 ? (maxEndMva / branch.ratingMva()) * 100.0 : 0.0;
            double maxPercent = Math.max(1.0, branch.maxLoadingPercent());

            branchFlows.add(new AcPowerFlowResult.BranchFlow(
                    branch.elementId(),
                    branch.elementType(),
                    branch.name(),
                    loadingPercent,
                    sFrom.re(),
                    sFrom.im(),
                    sTo.re(),
                    sTo.im(),
                    maxPercent
            ));

            if (loadingPercent > maxPercent) {
                thermalViolations.add(new AcPowerFlowResult.ThermalViolation(
                        branch.elementId(),
                        branch.elementType(),
                        branch.name(),
                        loadingPercent,
                        maxPercent
                ));
            }

            totalLossesMw += sFrom.re() + sTo.re();
        }

        AcPowerFlowResult.Summary summary = new AcPowerFlowResult.Summary(
                totalLoadMw,
                totalGenerationMw,
                totalLossesMw
        );

        return new AcPowerFlowResult(
                true,
                iterations,
                summary,
                busStates,
                branchFlows,
                voltageViolations,
                thermalViolations,
                List.of()
        );
    }

    private YBusModel buildYBus(AcPowerFlowInput input) {
        int nBus = input.buses().size();
        double[][] g = new double[nBus][nBus];
        double[][] b = new double[nBus][nBus];

        for (BranchEdge branch : input.branches()) {
            double den = branch.resistancePu() * branch.resistancePu() + branch.reactancePu() * branch.reactancePu();
            if (den < 1e-12) {
                continue;
            }

            ComplexNumber ySeries = new ComplexNumber(branch.resistancePu() / den, -branch.reactancePu() / den);
            ComplexNumber yShuntHalf = new ComplexNumber(0.0, branch.shuntSusceptancePu() / 2.0);

            ComplexNumber tap = polar(branch.tapRatio(), Math.toRadians(branch.phaseShiftDeg()));
            ComplexNumber tapConj = tap.conjugate();
            ComplexNumber tapNorm = tap.multiply(tapConj);

            ComplexNumber yff = ySeries.add(yShuntHalf).divide(tapNorm);
            ComplexNumber yft = ySeries.multiply(-1.0).divide(tapConj);
            ComplexNumber ytf = ySeries.multiply(-1.0).divide(tap);
            ComplexNumber ytt = ySeries.add(yShuntHalf);

            int f = branch.fromIndex();
            int t = branch.toIndex();
            g[f][f] += yff.re();
            b[f][f] += yff.im();
            g[f][t] += yft.re();
            b[f][t] += yft.im();
            g[t][f] += ytf.re();
            b[t][f] += ytf.im();
            g[t][t] += ytt.re();
            b[t][t] += ytt.im();
        }

        return new YBusModel(g, b);
    }

    private double[] buildMismatch(
            AcPowerFlowInput input,
            List<Integer> pEquationBuses,
            List<Integer> pqBuses,
            double[][] power
    ) {
        int size = pEquationBuses.size() + pqBuses.size();
        double[] mismatch = new double[size];
        int cursor = 0;
        for (Integer i : pEquationBuses) {
            mismatch[cursor++] = input.buses().get(i).pSpecPu() - power[0][i];
        }
        for (Integer i : pqBuses) {
            mismatch[cursor++] = input.buses().get(i).qSpecPu() - power[1][i];
        }
        return mismatch;
    }

    private double[][] buildJacobian(
            AcPowerFlowInput input,
            List<Integer> pEquationBuses,
            List<Integer> pqBuses,
            double[] vm,
            double[] va,
            double[][] power,
            double[][] g,
            double[][] b
    ) {
        int nP = pEquationBuses.size();
        int nQ = pqBuses.size();
        int size = nP + nQ;
        double[][] jac = new double[size][size];

        for (int row = 0; row < nP; row++) {
            int i = pEquationBuses.get(row);
            for (int col = 0; col < nP; col++) {
                int k = pEquationBuses.get(col);
                if (i == k) {
                    jac[row][col] = -power[1][i] - b[i][i] * vm[i] * vm[i];
                } else {
                    double angle = va[i] - va[k];
                    jac[row][col] = vm[i] * vm[k] * (g[i][k] * Math.sin(angle) - b[i][k] * Math.cos(angle));
                }
            }
            for (int col = 0; col < nQ; col++) {
                int k = pqBuses.get(col);
                if (i == k) {
                    jac[row][nP + col] = (power[0][i] / vm[i]) + g[i][i] * vm[i];
                } else {
                    double angle = va[i] - va[k];
                    jac[row][nP + col] = vm[i] * (g[i][k] * Math.cos(angle) + b[i][k] * Math.sin(angle));
                }
            }
        }

        for (int row = 0; row < nQ; row++) {
            int i = pqBuses.get(row);
            for (int col = 0; col < nP; col++) {
                int k = pEquationBuses.get(col);
                if (i == k) {
                    jac[nP + row][col] = power[0][i] - g[i][i] * vm[i] * vm[i];
                } else {
                    double angle = va[i] - va[k];
                    jac[nP + row][col] = -vm[i] * vm[k] * (g[i][k] * Math.cos(angle) + b[i][k] * Math.sin(angle));
                }
            }
            for (int col = 0; col < nQ; col++) {
                int k = pqBuses.get(col);
                if (i == k) {
                    jac[nP + row][nP + col] = (power[1][i] / vm[i]) - b[i][i] * vm[i];
                } else {
                    double angle = va[i] - va[k];
                    jac[nP + row][nP + col] = vm[i] * (g[i][k] * Math.sin(angle) - b[i][k] * Math.cos(angle));
                }
            }
        }
        return jac;
    }

    private double[][] computePower(int nBus, double[] vm, double[] va, double[][] g, double[][] b) {
        double[] p = new double[nBus];
        double[] q = new double[nBus];
        for (int i = 0; i < nBus; i++) {
            double pSum = 0.0;
            double qSum = 0.0;
            for (int k = 0; k < nBus; k++) {
                double angle = va[i] - va[k];
                pSum += vm[i] * vm[k] * (g[i][k] * Math.cos(angle) + b[i][k] * Math.sin(angle));
                qSum += vm[i] * vm[k] * (g[i][k] * Math.sin(angle) - b[i][k] * Math.cos(angle));
            }
            p[i] = pSum;
            q[i] = qSum;
        }
        return new double[][]{p, q};
    }

    private double maxAbs(double[] vector) {
        double max = 0.0;
        for (double value : vector) {
            max = Math.max(max, Math.abs(value));
        }
        return max;
    }

    private double[] solveLinearSystem(double[][] matrix, double[] rhs) {
        int n = rhs.length;
        double[][] a = new double[n][n];
        double[] b = new double[n];
        for (int i = 0; i < n; i++) {
            System.arraycopy(matrix[i], 0, a[i], 0, n);
            b[i] = rhs[i];
        }

        for (int pivot = 0; pivot < n; pivot++) {
            int maxRow = pivot;
            for (int row = pivot + 1; row < n; row++) {
                if (Math.abs(a[row][pivot]) > Math.abs(a[maxRow][pivot])) {
                    maxRow = row;
                }
            }
            swapRows(a, b, pivot, maxRow);
            double pivotValue = a[pivot][pivot];
            if (Math.abs(pivotValue) < 1e-12) {
                throw new PowerFlowCalculationException("Power flow Jacobian is singular.");
            }

            for (int row = pivot + 1; row < n; row++) {
                double factor = a[row][pivot] / pivotValue;
                a[row][pivot] = 0.0;
                for (int col = pivot + 1; col < n; col++) {
                    a[row][col] -= factor * a[pivot][col];
                }
                b[row] -= factor * b[pivot];
            }
        }

        double[] x = new double[n];
        for (int row = n - 1; row >= 0; row--) {
            double value = b[row];
            for (int col = row + 1; col < n; col++) {
                value -= a[row][col] * x[col];
            }
            x[row] = value / a[row][row];
        }
        return x;
    }

    private void swapRows(double[][] matrix, double[] vector, int rowA, int rowB) {
        if (rowA == rowB) {
            return;
        }
        double[] temp = matrix[rowA];
        matrix[rowA] = matrix[rowB];
        matrix[rowB] = temp;

        double tempVal = vector[rowA];
        vector[rowA] = vector[rowB];
        vector[rowB] = tempVal;
    }

    private ComplexNumber polar(double magnitude, double angleRad) {
        return new ComplexNumber(magnitude * Math.cos(angleRad), magnitude * Math.sin(angleRad));
    }

    private record YBusModel(double[][] g, double[][] b) {
    }
}
