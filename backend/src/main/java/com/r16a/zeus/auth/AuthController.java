package com.r16a.zeus.auth;

import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    @GetMapping("/csrf-token")
    public CsrfToken getCsrfToken(CsrfToken csrfToken) {
        return csrfToken;
    }
}
