import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AbortUploadDto } from './dto/abort-upload.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { InitiateUploadDto } from './dto/initiate-upload.dto';
import { VideosService } from './videos.service';

@ApiTags('videos')
@ApiBearerAuth()
@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Post()
  @ApiOperation({
    summary: 'Initiate a video upload',
    description:
      'Pre-registers the video as a draft and returns presigned part URLs for a direct-to-storage multipart upload.',
  })
  initiate(
    @CurrentUser() user: JwtPayload,
    @Body() dto: InitiateUploadDto,
  ) {
    return this.videosService.initiateUpload(user.sub, dto);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete a video upload',
    description:
      'Finalizes the multipart upload, moves the video to processing and enqueues the processing job.',
  })
  complete(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteUploadDto,
  ) {
    return this.videosService.completeUpload(user.sub, id, dto);
  }

  @Post(':id/abort')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Abort a video upload',
    description: 'Aborts the in-progress multipart upload and removes the draft.',
  })
  abort(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AbortUploadDto,
  ): Promise<void> {
    return this.videosService.abortUpload(user.sub, id, dto.uploadId);
  }
}
