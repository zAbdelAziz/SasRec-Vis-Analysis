# Local SASRec checkpoint

Place the selected trained weights here as **`SASREC_CHECKPOINT.pth`**.

If possible, place the training run's `args.txt` next to the weights so the app
can reconstruct hidden size, sequence length, and layer normalization settings.
The app loads this file automatically on startup/status refresh. It never trains
or modifies the upstream repository.

Binary weights are excluded from the source ZIP and Git by `.gitignore`.
