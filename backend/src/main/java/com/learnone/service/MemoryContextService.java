package com.learnone.service;

import com.learnone.entity.KnowledgeNode;
import com.learnone.entity.UserMemory;
import com.learnone.repository.KnowledgeNodeRepository;
import com.learnone.repository.UserMemoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MemoryContextService {

    private final UserMemoryRepository memoryRepo;
    private final KnowledgeNodeRepository nodeRepo;

    public String buildBlock(Long userId) {
        List<UserMemory> memories = memoryRepo.findTop10ByUserIdOrderByConfidenceDescUpdatedAtDesc(userId);
        List<KnowledgeNode> nodes = nodeRepo.findTop15ByUserIdOrderByMasteryDesc(userId);
        if (memories.isEmpty() && nodes.isEmpty()) return "";

        StringBuilder sb = new StringBuilder();
        if (!memories.isEmpty()) {
            sb.append("\n\nLearner profile:");
            for (UserMemory m : memories) {
                String val = m.getValue().length() > 120 ? m.getValue().substring(0, 120) + "…" : m.getValue();
                sb.append("\n- [").append(m.getCategory()).append("] ").append(val)
                  .append(" (").append(m.getConfidence()).append("% confidence)");
            }
        }
        if (!nodes.isEmpty()) {
            sb.append("\n\nConcept mastery:");
            for (KnowledgeNode n : nodes) {
                sb.append("\n- ").append(n.getConceptLabel()).append(": ")
                  .append(n.getMastery()).append("/100 (")
                  .append(n.getExposures()).append(" exposure").append(n.getExposures() == 1 ? "" : "s").append(")");
            }
        }
        return sb.toString();
    }
}
