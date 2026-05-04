package com.learnone.controller;

import com.learnone.dto.UserResponse;
import com.learnone.entity.User;
import com.learnone.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal UserDetails principal) {
        User user = userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return new UserResponse(user.getId(), user.getEmail(), user.getCreatedAt());
    }
}
