package com.learnone.dto;

import java.time.OffsetDateTime;

public record MemoryResponse(Long id, String key, String value, String category, int confidence, OffsetDateTime updatedAt) {}
