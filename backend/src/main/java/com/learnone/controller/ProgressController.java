package com.learnone.controller;

import com.learnone.dto.ProgressResponse;
import com.learnone.entity.KnowledgeNode;
import com.learnone.repository.KnowledgeNodeRepository;
import com.learnone.repository.UserRepository;
import com.learnone.service.SpacedRepetitionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/progress")
@RequiredArgsConstructor
public class ProgressController {

    private final KnowledgeNodeRepository nodeRepo;
    private final SpacedRepetitionService srService;
    private final UserRepository userRepository;

    @GetMapping
    public ProgressResponse get(@AuthenticationPrincipal UserDetails principal) {
        Long userId = resolveUserId(principal);
        List<KnowledgeNode> nodes = nodeRepo.findTop15ByUserIdOrderByExposuresDescMasteryDesc(userId);

        int total = nodes.size();
        int mastered = (int) nodes.stream().filter(n -> n.getMastery() >= 75).count();
        int learning = (int) nodes.stream().filter(n -> n.getMastery() >= 30 && n.getMastery() < 75).count();
        int struggling = total - mastered - learning;
        double avg = total == 0 ? 0 : nodes.stream().mapToInt(KnowledgeNode::getMastery).average().orElse(0);
        int due = srService.countDue(userId);

        return new ProgressResponse(total, mastered, learning, struggling, Math.round(avg * 10.0) / 10.0, due);
    }

    private Long resolveUserId(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED))
                .getId();
    }
}
