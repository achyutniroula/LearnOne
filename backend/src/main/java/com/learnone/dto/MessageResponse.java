package com.learnone.dto;

import java.time.OffsetDateTime;

public record MessageResponse(Long id, String role, String content, String imageData, String imageMediaType, OffsetDateTime createdAt) {}
