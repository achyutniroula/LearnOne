package com.learnone.controller;

import com.learnone.dto.*;
import com.learnone.entity.*;
import com.learnone.repository.UserRepository;
import com.learnone.service.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class LearningSessionController {

    private final LearningSessionService sessionService;
    private final CurriculumService curriculumService;
    private final UserRepository userRepository;

    @PostMapping
    public ResponseEntity<SessionResponse> create(
            @Valid @RequestBody CreateSessionRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        Long userId = resolveUserId(principal);
        LearningSession session = sessionService.createSession(userId, req.learningGoal());
        curriculumService.generateAsync(session.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(session));
    }

    @GetMapping
    public List<SessionResponse> list(@AuthenticationPrincipal UserDetails principal) {
        Long userId = resolveUserId(principal);
        return sessionService.listSessions(userId).stream().map(this::toDto).toList();
    }

    @GetMapping("/{id}/messages")
    public List<MessageResponse> messages(@PathVariable Long id,
                                          @AuthenticationPrincipal UserDetails principal) {
        Long userId = resolveUserId(principal);
        sessionService.getSessionForUser(id, userId);
        return sessionService.getHistory(id).stream()
                .map(m -> new MessageResponse(m.getId(), m.getRole().name(), m.getContent(),
                        m.getImageData(), m.getImageMediaType(), m.getCreatedAt()))
                .toList();
    }

    @GetMapping("/{id}/curriculum")
    public ResponseEntity<String> curriculum(@PathVariable Long id,
                                             @AuthenticationPrincipal UserDetails principal) {
        Long userId = resolveUserId(principal);
        Curriculum c = curriculumService.getForSessionOrThrow(id, userId);
        return ResponseEntity.ok()
                .header("Content-Type", "application/json")
                .body(c.getContent());
    }

    private Long resolveUserId(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED))
                .getId();
    }

    private SessionResponse toDto(LearningSession s) {
        return new SessionResponse(s.getId(), s.getTitle(), s.getLearningGoal(), s.getStatus(), s.getCreatedAt());
    }
}
