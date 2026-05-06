package com.learnone.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ChatRequest(
        @NotBlank String message,
        @Size(max = 5_000_000) String imageData,
        @Pattern(regexp = "image/(jpeg|png|gif|webp)") String imageMediaType
) {}
