package com.learnone.dto;

import java.time.OffsetDateTime;

public record KnowledgeNodeResponse(Long id, String conceptSlug, String conceptLabel, int mastery, int exposures, OffsetDateTime updatedAt) {}
