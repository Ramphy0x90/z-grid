package com.r16a.zeus.core;

import com.r16a.zeus.auth.exception.InvalidCredentialsException;
import com.r16a.zeus.features.grid.exception.GridDatasetValidationException;
import com.r16a.zeus.features.grid.exception.GridNotFoundException;
import com.r16a.zeus.features.simulation.exception.PowerFlowCalculationException;
import com.r16a.zeus.features.simulation.exception.SimulationApiDisabledException;
import com.r16a.zeus.features.simulation.exception.SimulationExecutionException;
import com.r16a.zeus.features.simulation.exception.SimulationRunNotFoundException;
import com.r16a.zeus.features.simulation.model.SimulationFailureCode;
import com.r16a.zeus.team.exception.TeamConflictException;
import com.r16a.zeus.team.exception.TeamNotFoundException;
import com.r16a.zeus.project.exception.ProjectConflictException;
import com.r16a.zeus.project.exception.ProjectExampleNotFoundException;
import com.r16a.zeus.project.exception.ProjectNotFoundException;
import com.r16a.zeus.user.exception.UserConflictException;
import com.r16a.zeus.user.exception.InvalidUserPreferencesException;
import com.r16a.zeus.user.exception.UserNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(InvalidCredentialsException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public ProblemDetail handleInvalidCredentials(InvalidCredentialsException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, ex.getMessage());
    }

    @ExceptionHandler(UserNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ProblemDetail handleUserNotFound(UserNotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(UserConflictException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ProblemDetail handleUserConflict(UserConflictException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(InvalidUserPreferencesException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ProblemDetail handleInvalidUserPreferences(InvalidUserPreferencesException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    @ExceptionHandler(TeamNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ProblemDetail handleTeamNotFound(TeamNotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(TeamConflictException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ProblemDetail handleTeamConflict(TeamConflictException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(ProjectNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ProblemDetail handleProjectNotFound(ProjectNotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(ProjectConflictException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ProblemDetail handleProjectConflict(ProjectConflictException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(ProjectExampleNotFoundException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ProblemDetail handleProjectExampleNotFound(ProjectExampleNotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    @ExceptionHandler(GridNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ProblemDetail handleGridNotFound(GridNotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(GridDatasetValidationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ProblemDetail handleGridDatasetValidation(GridDatasetValidationException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    @ExceptionHandler(SimulationRunNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ProblemDetail handleSimulationRunNotFound(SimulationRunNotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(PowerFlowCalculationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ProblemDetail handlePowerFlowCalculation(PowerFlowCalculationException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    @ExceptionHandler(SimulationApiDisabledException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public ProblemDetail handleSimulationApiDisabled(SimulationApiDisabledException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE, ex.getMessage());
    }

    @ExceptionHandler(SimulationExecutionException.class)
    public ProblemDetail handleSimulationExecution(SimulationExecutionException ex) {
        HttpStatus status = ex.getFailureCode() == SimulationFailureCode.SYSTEM_ERROR
                ? HttpStatus.INTERNAL_SERVER_ERROR
                : HttpStatus.UNPROCESSABLE_ENTITY;
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(status, ex.getMessage());
        detail.setProperty("failureCode", ex.getFailureCode());
        return detail;
    }
}
