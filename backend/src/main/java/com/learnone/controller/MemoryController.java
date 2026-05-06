package com.learnone.controller;

import com.learnone.dto.KnowledgeNodeResponse;
import com.learnone.dto.MemoryResponse;
import com.learnone.repository.KnowledgeNodeRepository;
import com.learnone.repository.UserMemoryRepository;
import com.learnone.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class MemoryController {

    private final UserMemoryRepository memoryRepo;
    private final KnowledgeNodeRepository nodeRepo;
    private final UserRepository userRepo;

    @GetMapping("/memory")
    public List<MemoryResponse> memories(@AuthenticationPrincipal UserDetails principal) {
        Long userId = resolveUserId(principal);
        return memoryRepo.findByUserIdOrderByConfidenceDescUpdatedAtDesc(userId).stream()
                .map(m -> new MemoryResponse(m.getId(), m.getKey(), m.getValue(),
                        m.getCategory(), m.getConfidence(), m.getUpdatedAt()))
                .toList();
    }

    @GetMapping("/knowledge-graph")
    public List<KnowledgeNodeResponse> knowledgeGraph(@AuthenticationPrincipal UserDetails principal) {
        Long userId = resolveUserId(principal);
        return nodeRepo.findByUserIdOrderByMasteryDesc(userId).stream()
                .map(n -> new KnowledgeNodeResponse(n.getId(), n.getConceptSlug(), n.getConceptLabel(),
                        n.getMastery(), n.getExposures(), n.getUpdatedAt()))
                .toList();
    }

    private Long resolveUserId(UserDetails principal) {
        return userRepo.findByEmail(principal.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED))
                .getId();
    }
}
