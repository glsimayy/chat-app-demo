package com.ello.webhook;

import java.util.List;
import java.util.UUID;

public record CreateBotGroupRequest(
        UUID ownerId,
        String name,
        List<UUID> participantIds,
        String externalRef,
        String initialSystemMessage) {
}
