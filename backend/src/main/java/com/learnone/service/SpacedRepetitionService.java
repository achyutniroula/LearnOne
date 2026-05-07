package com.learnone.service;

import com.learnone.entity.ConceptReview;
import com.learnone.repository.ConceptReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SpacedRepetitionService {

    private final ConceptReviewRepository reviewRepo;

    @Transactional
    public void initIfAbsent(Long userId, String slug, String label) {
        if (reviewRepo.findByUserIdAndConceptSlug(userId, slug).isEmpty()) {
            reviewRepo.save(new ConceptReview(userId, slug, label));
        }
    }

    @Transactional
    public void record(Long userId, String conceptSlug, int quality) {
        ConceptReview r = reviewRepo.findByUserIdAndConceptSlug(userId, conceptSlug)
                .orElseThrow(() -> new IllegalArgumentException("Review not found: " + conceptSlug));

        if (quality < 3) {
            r.setRepetitions(0);
            r.setIntervalDays(1);
        } else {
            int n = r.getRepetitions();
            if (n == 0) r.setIntervalDays(1);
            else if (n == 1) r.setIntervalDays(6);
            else r.setIntervalDays((int) Math.round(r.getIntervalDays() * r.getEaseFactor()));
            r.setRepetitions(n + 1);
        }

        double ef = r.getEaseFactor() + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
        r.setEaseFactor(Math.max(1.3, ef));
        r.setNextReviewAt(OffsetDateTime.now().plusDays(r.getIntervalDays()));
        r.setLastReviewedAt(OffsetDateTime.now());
        reviewRepo.save(r);
    }

    public List<ConceptReview> getDue(Long userId) {
        return reviewRepo.findByUserIdAndNextReviewAtBeforeOrderByNextReviewAtAsc(userId, OffsetDateTime.now());
    }

    public int countDue(Long userId) {
        return reviewRepo.countByUserIdAndNextReviewAtBefore(userId, OffsetDateTime.now());
    }
}
