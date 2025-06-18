import { EventEmitter } from 'events';

interface Job {
  id: string;
  taskId: string;
  type: string;
  data: any;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
  priority: number;
  timeout?: number;
}

export class JobManager extends EventEmitter {
  private jobs: Map<string, Job> = new Map();
  private queue: Job[] = [];
  private workers: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;
  private maxConcurrentJobs: number = 5;
  private pollInterval: number = 1000; // 1 second

  constructor(maxConcurrentJobs: number = 5) {
    super();
    this.maxConcurrentJobs = maxConcurrentJobs;
    this.start();
  }

  public addJob(
    taskId: string,
    type: string,
    data: any,
    options: {
      priority?: number;
      maxRetries?: number;
      timeout?: number;
    } = {}
  ): string {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: Job = {
      id: jobId,
      taskId,
      type,
      data,
      status: 'pending',
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
      priority: options.priority || 0,
      timeout: options.timeout
    };

    this.jobs.set(jobId, job);
    this.enqueue(job);
    
    this.emit('job-added', job);
    return jobId;
  }

  public getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  public cancelJob(taskId: string): boolean {
    // Find jobs by taskId
    const jobsToCancel = Array.from(this.jobs.values()).filter(job => job.taskId === taskId);
    
    let cancelled = false;
    for (const job of jobsToCancel) {
      if (job.status === 'pending' || job.status === 'running') {
        job.status = 'cancelled';
        job.completedAt = new Date();
        
        // Remove from queue if pending
        const queueIndex = this.queue.findIndex(q => q.id === job.id);
        if (queueIndex !== -1) {
          this.queue.splice(queueIndex, 1);
        }

        // Clear worker timeout if running
        const worker = this.workers.get(job.id);
        if (worker) {
          clearTimeout(worker);
          this.workers.delete(job.id);
        }

        this.emit('job-cancelled', job);
        cancelled = true;
      }
    }

    return cancelled;
  }

  public getQueueStatus(): {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    const status = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };

    for (const job of this.jobs.values()) {
      status[job.status]++;
    }

    return status;
  }

  public getQueueInfo(): {
    queueLength: number;
    activeWorkers: number;
    totalJobs: number;
    status: { [key: string]: number };
  } {
    return {
      queueLength: this.queue.length,
      activeWorkers: this.workers.size,
      totalJobs: this.jobs.size,
      status: this.getQueueStatus()
    };
  }

  private enqueue(job: Job): void {
    // Insert job in priority order (higher priority first)
    let inserted = false;
    for (let i = 0; i < this.queue.length; i++) {
      if (job.priority > this.queue[i].priority) {
        this.queue.splice(i, 0, job);
        inserted = true;
        break;
      }
    }
    
    if (!inserted) {
      this.queue.push(job);
    }
  }

  private async processNextJob(): Promise<void> {
    if (this.workers.size >= this.maxConcurrentJobs || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    if (!job || job.status !== 'pending') {
      return;
    }

    job.status = 'running';
    job.startedAt = new Date();
    this.emit('job-started', job);

    // Set up timeout if specified
    let timeoutId: NodeJS.Timeout | undefined;
    if (job.timeout) {
      timeoutId = setTimeout(() => {
        this.handleJobTimeout(job);
      }, job.timeout * 1000);
    }

    this.workers.set(job.id, timeoutId!);

    try {
      // Here you would actually process the job
      // For now, we'll simulate processing
      await this.executeJob(job);
      
      job.status = 'completed';
      job.completedAt = new Date();
      this.emit('job-completed', job);
      
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      
      if (job.retryCount < job.maxRetries) {
        job.retryCount++;
        job.status = 'pending';
        this.enqueue(job);
        this.emit('job-retry', job);
      } else {
        job.status = 'failed';
        job.completedAt = new Date();
        this.emit('job-failed', job);
      }
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      this.workers.delete(job.id);
    }
  }

  private async executeJob(job: Job): Promise<void> {
    // Simulate job execution time based on job type
    const executionTime = this.getJobExecutionTime(job.type);
    
    // Simulate progress updates
    const progressSteps = 5;
    const stepTime = executionTime / progressSteps;
    
    for (let i = 0; i < progressSteps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepTime));
      
      // Check if job was cancelled during execution
      if (job.status === 'cancelled') {
        throw new Error('Job was cancelled');
      }
      
      const progress = ((i + 1) / progressSteps) * 100;
      this.emit('job-progress', job, progress);
    }
  }

  private getJobExecutionTime(jobType: string): number {
    // Return estimated execution time in milliseconds
    switch (jobType) {
      case 'video-generation':
        return 30000; // 30 seconds
      case 'course-creation':
        return 10000; // 10 seconds
      case 'translation':
        return 5000; // 5 seconds
      case 'validation':
        return 2000; // 2 seconds
      default:
        return 5000; // 5 seconds default
    }
  }

  private handleJobTimeout(job: Job): void {
    if (job.status === 'running') {
      console.log(`Job ${job.id} timed out`);
      
      if (job.retryCount < job.maxRetries) {
        job.retryCount++;
        job.status = 'pending';
        this.enqueue(job);
        this.emit('job-timeout-retry', job);
      } else {
        job.status = 'failed';
        job.completedAt = new Date();
        this.emit('job-timeout-failed', job);
      }
    }
  }

  private start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.processQueue();
  }

  private processQueue(): void {
    if (!this.isRunning) {
      return;
    }

    // Process as many jobs as possible
    for (let i = 0; i < this.maxConcurrentJobs - this.workers.size; i++) {
      this.processNextJob().catch(error => {
        console.error('Error processing job:', error);
      });
    }

    // Schedule next processing cycle
    setTimeout(() => this.processQueue(), this.pollInterval);
  }

  public shutdown(): void {
    this.isRunning = false;
    
    // Cancel all running jobs
    for (const [jobId, timeoutId] of this.workers.entries()) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      const job = this.jobs.get(jobId);
      if (job && job.status === 'running') {
        job.status = 'cancelled';
        job.completedAt = new Date();
        this.emit('job-cancelled', job);
      }
    }
    
    this.workers.clear();
    this.queue.length = 0;
  }

  public clearCompleted(): number {
    const before = this.jobs.size;
    
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        this.jobs.delete(jobId);
      }
    }
    
    return before - this.jobs.size;
  }
}
