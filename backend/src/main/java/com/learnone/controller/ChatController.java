package com.learnone.controller;

import com.learnone.dto.ChatRequest;
import com.learnone.dto.ChatResponse;
import com.learnone.service.ChatEngineService;
import com.learnone.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class ChatController {

    private final ChatEngineService chatEngine;
    private final UserRepository userRepository;

    @PostMapping("/{id}/chat")
    public ChatResponse chat(@PathVariable Long id,
                             @Valid @RequestBody ChatRequest req,
                             @AuthenticationPrincipal UserDetails principal) {
        Long userId = userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED))
                .getId();

        String reply = chatEngine.chat(id, userId, principal.getUsername(), req.message());
        return new ChatResponse("assistant", reply);
    }
}
