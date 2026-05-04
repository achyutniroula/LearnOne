package com.learnone.dto;

import java.time.OffsetDateTime;

public record UserResponse(Long id, String email, OffsetDateTime createdAt) {}
