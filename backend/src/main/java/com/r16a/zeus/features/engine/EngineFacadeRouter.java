package com.r16a.zeus.features.engine;

import com.r16a.zeus.features.simulation.model.SimulationType;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class EngineFacadeRouter {
    private final List<EngineFacade> engineFacades;

    public EngineFacadeRouter(List<EngineFacade> engineFacades) {
        this.engineFacades = List.copyOf(engineFacades);
    }

    public EngineFacade resolve(SimulationType simulationType, String engineKey) {
        return engineFacades.stream()
                .filter((facade) -> facade.simulationType() == simulationType && facade.engineKey().equals(engineKey))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "No engine facade registered for simulation type " + simulationType + " and engine key " + engineKey
                ));
    }
}
