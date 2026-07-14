package com.example.demo;

import lombok.Data;
import java.util.List;

@Data
public class TicketWebHookDto {
    private String eventType;
    private String ticketId;
    private String title;
    private List<String> participantIds;
}
