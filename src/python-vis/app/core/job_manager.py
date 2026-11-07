"""Single-worker, in-process analysis queue; progress is visible via /api/jobs."""
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from uuid import uuid4


class JobManager:
    def __init__(self):
        self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix='analysis')
        self.lock = Lock()
        self.jobs = {}

    def submit(self, action):
        job_id = uuid4().hex
        with self.lock:
            self.jobs[job_id] = {'job_id': job_id, 'status': 'queued', 'error': None,
                                 'progress': 0, 'detail': 'Waiting for the analysis worker'}
        self.executor.submit(self._execute, job_id, action)
        return self.status(job_id)

    def _execute(self, job_id, action):
        with self.lock:
            self.jobs[job_id].update(status='running', detail='Preparing analysis')

        def progress(done, total, detail='Running analysis'):
            with self.lock:
                percent = round(100 * done / max(total, 1))
                self.jobs[job_id].update(progress=max(0, min(99, percent)), detail=detail)

        try:
            result = action(progress)
            with self.lock:
                self.jobs[job_id].update(status='complete', run_id=result['run_id'],
                                         progress=100, detail='Results saved')
        except Exception as exc:
            with self.lock:
                self.jobs[job_id].update(status='failed', error=str(exc), detail='Analysis failed')

    def status(self, job_id):
        with self.lock:
            return dict(self.jobs[job_id]) if job_id in self.jobs else None
