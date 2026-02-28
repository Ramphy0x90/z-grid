package com.r16a.zeus.features.grid.service.dataset;

import com.r16a.zeus.features.grid.model.Bus;
import com.r16a.zeus.features.grid.model.BusLayout;
import com.r16a.zeus.features.grid.model.EdgeLayout;
import com.r16a.zeus.features.grid.model.Generator;
import com.r16a.zeus.features.grid.model.Line;
import com.r16a.zeus.features.grid.model.Load;
import com.r16a.zeus.features.grid.model.ShuntCompensator;
import com.r16a.zeus.features.grid.model.Transformer;
import java.util.List;

public record GridDatasetSnapshot(
        List<Bus> buses,
        List<Line> lines,
        List<Transformer> transformers,
        List<Load> loads,
        List<Generator> generators,
        List<ShuntCompensator> shunts,
        List<BusLayout> busLayouts,
        List<EdgeLayout> edgeLayouts
) {
}
