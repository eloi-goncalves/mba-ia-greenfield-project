import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Redirect,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
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
  initiate(@CurrentUser() user: JwtPayload, @Body() dto: InitiateUploadDto) {
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
    description:
      'Aborts the in-progress multipart upload and removes the draft.',
  })
  abort(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AbortUploadDto,
  ): Promise<void> {
    return this.videosService.abortUpload(user.sub, id, dto.uploadId);
  }

  @Post(':id/reprocess')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reprocess a failed video',
    description: 'Re-enqueues processing for a video in the failed state.',
  })
  reprocess(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.videosService.reprocess(user.sub, id);
  }

  @Public()
  @Get(':publicId')
  @ApiOperation({
    summary: 'Get public video metadata',
    description:
      'Returns metadata for a ready video, including a presigned thumbnail URL.',
  })
  getPublic(@Param('publicId') publicId: string) {
    return this.videosService.getPublicVideo(publicId);
  }

  @Public()
  @Get(':publicId/stream')
  @Redirect()
  @ApiOperation({
    summary: 'Stream a video',
    description:
      'Redirects to a presigned storage URL that serves the video with HTTP Range (206) support.',
  })
  async stream(@Param('publicId') publicId: string) {
    const url = await this.videosService.getStreamUrl(publicId);
    return { url, statusCode: HttpStatus.FOUND };
  }

  @Public()
  @Get(':publicId/download')
  @Redirect()
  @ApiOperation({
    summary: 'Download a video',
    description:
      'Redirects to a presigned storage URL with a Content-Disposition attachment header.',
  })
  async download(@Param('publicId') publicId: string) {
    const url = await this.videosService.getDownloadUrl(publicId);
    return { url, statusCode: HttpStatus.FOUND };
  }
}
