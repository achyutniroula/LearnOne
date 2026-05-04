package com.learnone.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateSessionRequest(@NotBlank String learningGoal) {}
