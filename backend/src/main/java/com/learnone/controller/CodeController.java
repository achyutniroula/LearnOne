package com.learnone.controller;

import com.learnone.dto.CodeExecuteRequest;
import com.learnone.dto.CodeExecuteResponse;
import com.learnone.service.CodeExecutionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/code")
@RequiredArgsConstructor
public class CodeController {

    private final CodeExecutionService codeExecutionService;

    @PostMapping("/execute")
    public CodeExecuteResponse execute(@Valid @RequestBody CodeExecuteRequest req) {
        var result = codeExecutionService.execute(req.sourceCode(), req.languageId());
        return new CodeExecuteResponse(result.stdout(), result.stderr(), result.status(), result.exitCode());
    }
}
