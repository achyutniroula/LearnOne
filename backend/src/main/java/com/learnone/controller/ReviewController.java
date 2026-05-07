package com.learnone.controller;

import com.learnone.dto.ReviewDueResponse;
import com.learnone.repository.UserRepository;
import com.learnone.service.SpacedRepetitionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/review")
@RequiredArgsConstructor
public class ReviewController {

    private final SpacedRepetitionService srService;
    private final UserRepository userRepository;

    @GetMapping("/due")
    public List<ReviewDueResponse> getDue(@AuthenticationPrincipal UserDetails principal) {
        Long userId = resolveUserId(principal);
        return srService.getDue(userId).stream()
                .map(r -> new ReviewDueResponse(
                        r.getConceptSlug(), r.getConceptLabel(),
                        r.getIntervalDays(), r.getRepetitions(), r.getNextReviewAt()))
                .toList();
    }

    @PostMapping("/{slug}/record")
    public void record(@PathVariable String slug,
                       @RequestBody Map<String, Integer> body,
                       @AuthenticationPrincipal UserDetails principal) {
        Long userId = resolveUserId(principal);
        int quality = body.getOrDefault("quality", 3);
        srService.record(userId, slug, Math.max(0, Math.min(5, quality)));
    }

    private Long resolveUserId(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED))
                .getId();
    }
}
