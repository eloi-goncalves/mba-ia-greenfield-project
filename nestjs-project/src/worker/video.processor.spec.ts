import { Job } from 'bullmq';
import { VideoProcessingService } from './video-processing.service';
import { VideoProcessor } from './video.processor';

describe('VideoProcessor', () => {
  let processor: VideoProcessor;
  const markFailed = jest.fn();
  const process = jest.fn();

  beforeEach(() => {
    markFailed.mockReset();
    process.mockReset();
    processor = new VideoProcessor({
      process,
      markFailed,
    } as unknown as VideoProcessingService);
  });

  function job(attemptsMade: number, attempts: number): Job {
    return {
      data: { videoId: 'v1' },
      attemptsMade,
      opts: { attempts },
    } as unknown as Job;
  }

  it('delegates processing to the service', async () => {
    await processor.process(job(1, 3) as Job<{ videoId: string }>);
    expect(process).toHaveBeenCalledWith('v1');
  });

  it('marks the video failed only when all attempts are exhausted', async () => {
    await processor.onFailed(
      job(3, 3) as Job<{ videoId: string }>,
      new Error('boom'),
    );
    expect(markFailed).toHaveBeenCalledWith('v1', 'boom');
  });

  it('does not mark failed while retries remain', async () => {
    await processor.onFailed(
      job(1, 3) as Job<{ videoId: string }>,
      new Error('transient'),
    );
    expect(markFailed).not.toHaveBeenCalled();
  });
});
