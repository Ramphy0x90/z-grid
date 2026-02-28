package com.r16a.zeus.user.controller;

import com.r16a.zeus.user.User;
import com.r16a.zeus.user.dto.UpdateUserRequest;
import com.r16a.zeus.user.dto.UserResponse;
import com.r16a.zeus.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
@Tag(name = "User", description = "User management endpoints")
public class UserController {
    private final UserService userService;

    @GetMapping("/{id}")
    @Operation(summary = "Get user by ID", description = "Fetches a single user by its unique ID")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "User found"),
            @ApiResponse(responseCode = "404", description = "User not found", content = @Content)
    })
    public UserResponse getUserById(@PathVariable UUID id) {
        return UserResponse.from(userService.getUserByIdOrThrow(id));
    }

    @GetMapping("/username/{username}")
    @Operation(summary = "Get user by username", description = "Fetches a single user by username")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "User found"),
            @ApiResponse(responseCode = "404", description = "User not found", content = @Content)
    })
    public UserResponse getUserByUsername(@PathVariable String username) {
        return UserResponse.from(userService.getUserByUsernameOrThrow(username));
    }

    @GetMapping
    @Operation(summary = "Get users", description = "Fetches all users")
    @ApiResponse(responseCode = "200", description = "Users retrieved")
    public List<UserResponse> getUsers() {
        return userService.getUsers()
                .stream()
                .map(UserResponse::from)
                .toList();
    }

    @GetMapping("/team/{teamId}")
    @Operation(summary = "Get users in team", description = "Fetches all users belonging to the specified team")
    @ApiResponse(responseCode = "200", description = "Users retrieved")
    public List<UserResponse> getUsersInTeam(@PathVariable UUID teamId) {
        return userService.getUsersInTeam(teamId)
                .stream()
                .map(UserResponse::from)
                .toList();
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update user", description = "Updates mutable fields of an existing user")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "User updated"),
            @ApiResponse(responseCode = "404", description = "User not found", content = @Content)
    })
    public UserResponse updateUser(@PathVariable UUID id, @Valid @RequestBody UpdateUserRequest request) {
        User userToUpdate = User.builder()
                .username(request.username())
                .email(request.email())
                .fullName(request.fullName())
                .role(request.role())
                .active(request.active())
                .build();

        return UserResponse.from(userService.updateUser(id, userToUpdate));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete user", description = "Deletes a user by ID")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "User deleted", content = @Content),
            @ApiResponse(responseCode = "404", description = "User not found", content = @Content),
            @ApiResponse(responseCode = "409", description = "User cannot be deleted because of team constraints",
                    content = @Content(schema = @Schema(implementation = String.class)))
    })
    public ResponseEntity<Void> deleteUser(@PathVariable UUID id) {
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }
}
