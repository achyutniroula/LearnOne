package com.learnone.dto;

public record CodeExecuteResponse(String stdout, String stderr, String status, int exitCode) {}
