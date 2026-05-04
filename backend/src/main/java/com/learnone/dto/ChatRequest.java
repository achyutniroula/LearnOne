package com.learnone.dto;

import jakarta.validation.constraints.NotBlank;

public record ChatRequest(@NotBlank String message) {}
