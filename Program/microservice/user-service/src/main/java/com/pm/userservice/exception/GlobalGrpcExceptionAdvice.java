package com.pm.userservice.exception;

import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import net.devh.boot.grpc.server.advice.GrpcAdvice;
import net.devh.boot.grpc.server.advice.GrpcExceptionHandler;

@GrpcAdvice
public class GlobalGrpcExceptionAdvice {

    @GrpcExceptionHandler(UserNotFoundException.class)
    public StatusRuntimeException handleUserNotFound(UserNotFoundException e) {
        return Status.NOT_FOUND.withDescription(e.getMessage()).asRuntimeException();
    }

    @GrpcExceptionHandler(IllegalArgumentException.class)
    public StatusRuntimeException handleBadUuid(IllegalArgumentException e) {
        return Status.INVALID_ARGUMENT.withDescription("bad userId").asRuntimeException();
    }

    @GrpcExceptionHandler(Throwable.class)
    public StatusRuntimeException handleAll(Throwable t) {
        return Status.INTERNAL.withDescription("server error").withCause(t).asRuntimeException();
    }
}
