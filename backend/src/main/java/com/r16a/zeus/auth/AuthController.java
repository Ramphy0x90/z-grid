package com.r16a.zeus.auth;

import com.r16a.zeus.auth.dto.LoginRequest;
import com.r16a.zeus.auth.dto.LoginResponse;
import com.r16a.zeus.user.User;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @GetMapping("/csrf-token")
    public CsrfToken getCsrfToken(CsrfToken csrfToken) {
        return csrfToken;
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest credentials, HttpServletRequest httpRequest) {
        User user = authService.authenticate(credentials, httpRequest);
        return LoginResponse.from(user);
    }
}
