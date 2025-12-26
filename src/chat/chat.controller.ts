import { Body, Controller, Post, UseGuards, Req } from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { RateLimitGuard } from '../auth/guards/rate-limit.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthRequest } from 'src/common/interfaces/auth-request.interface';
import { OnboardingGuard } from 'src/auth/guards/onboarding.guard';

@Controller('chat')
@UseGuards(new RateLimitGuard(60, 60_000), JwtAuthGuard, OnboardingGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async sendMessage(@Body() body: SendMessageDto, @Req() req: AuthRequest) {
    const userId = req.user.sub;
    const type = req.user.type;
    return this.chatService.processMessage(body, userId, type);
  }
}
