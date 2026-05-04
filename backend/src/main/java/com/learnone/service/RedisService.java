package com.learnone.service;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class RedisService {

    private final StringRedisTemplate redis;

    @PostConstruct
    public void smokeTest() {
        try {
            set("learnone:startup", "ok", Duration.ofMinutes(1));
            String val = get("learnone:startup").orElse("missing");
            log.info("Redis smoke test: {}", val);
        } catch (Exception e) {
            log.error("Redis smoke test failed: {}", e.getMessage());
        }
    }

    public void set(String key, String value, Duration ttl) {
        redis.opsForValue().set(key, value, ttl);
    }

    public Optional<String> get(String key) {
        return Optional.ofNullable(redis.opsForValue().get(key));
    }

    public void delete(String key) {
        redis.delete(key);
    }

    public Long increment(String key) {
        return redis.opsForValue().increment(key);
    }

    public void expire(String key, Duration ttl) {
        redis.expire(key, ttl);
    }
}
