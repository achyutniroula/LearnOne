package com.learnone.controller;

import com.learnone.dto.QuizResponse;
import com.learnone.entity.Quiz;
import com.learnone.repository.UserRepository;
import com.learnone.service.QuizService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class QuizController {

    private final QuizService quizService;
    private final UserRepository userRepository;

    @PostMapping("/{id}/quiz")
    public QuizResponse generate(@PathVariable Long id,
                                 @AuthenticationPrincipal UserDetails principal) {
        Long userId = resolveUserId(principal);
        Quiz quiz = quizService.generateOrGet(id, userId);
        return toResponse(quiz);
    }

    @GetMapping("/{id}/quiz")
    public QuizResponse get(@PathVariable Long id,
                            @AuthenticationPrincipal UserDetails principal) {
        Long userId = resolveUserId(principal);
        Quiz quiz = quizService.generateOrGet(id, userId);
        return toResponse(quiz);
    }

    private QuizResponse toResponse(Quiz quiz) {
        var questions = quiz.getQuestions().stream()
                .map(q -> new QuizResponse.QuestionDto(
                        q.getId(), q.getQuestion(), q.getType(),
                        q.getChoices(), q.getCorrectAnswer(), q.getExplanation()))
                .toList();
        return new QuizResponse(quiz.getId(), questions);
    }

    private Long resolveUserId(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED))
                .getId();
    }
}
