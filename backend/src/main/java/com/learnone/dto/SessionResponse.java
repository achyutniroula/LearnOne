package com.learnone.dto;

import java.time.OffsetDateTime;

public record SessionResponse(Long id, String title, String learningGoal, String status, OffsetDateTime createdAt) {}
