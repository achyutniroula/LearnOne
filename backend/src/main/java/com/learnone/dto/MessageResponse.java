package com.learnone.dto;

import java.time.OffsetDateTime;

public record MessageResponse(Long id, String role, String content, OffsetDateTime createdAt) {}
