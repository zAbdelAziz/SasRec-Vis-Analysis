"""Repeat-safe download of official MovieLens-1M and the external ID mapping."""
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import urlopen
from zipfile import ZipFile
import shutil

from app.config import Settings


class MovieLensSetup:
    MOVIELENS_URL = 'https://files.grouplens.org/datasets/movielens/ml-1m.zip'
    MAPPING_RAW_URL = 'https://raw.githubusercontent.com/asash/ml1m-sas-mapping/main'
    RAW_FILES = ('ratings.dat', 'movies.dat', 'users.dat')
    MAP_FILES = ('sas_to_original_items.txt', 'sas_to_original_users.txt')

    def __init__(self, settings: Settings):
        self.settings = settings
        self.raw = settings.raw_movielens
        self.mapping = settings.project_root / 'src/data/mapping-source'

    @staticmethod
    def _present(folder: Path, filenames: tuple[str, ...]) -> bool:
        return all((folder / name).is_file() and (folder / name).stat().st_size > 0
                   for name in filenames)

    def install(self) -> list[str]:
        """Only acquire missing files; never overwrite existing data or model weights."""
        messages = []
        if self._present(self.raw, self.RAW_FILES):
            messages.append('MovieLens-1M: already present, skipped')
        else:
            self._download_movielens()
            messages.append('MovieLens-1M: downloaded official dataset')
        if self._present(self.mapping, self.MAP_FILES):
            messages.append('SASRec ID mapping: already present, skipped')
        else:
            self._clone_mapping()
            messages.append('SASRec ID mapping: missing files downloaded')
        return messages

    def _download_movielens(self) -> None:
        if self._present(self.raw, self.RAW_FILES):
            return
        self.raw.mkdir(parents=True, exist_ok=True)
        with TemporaryDirectory(prefix='movielens-setup-', dir=self.raw) as temporary:
            archive_path = Path(temporary) / 'ml-1m.zip'
            with urlopen(self.MOVIELENS_URL, timeout=60) as source, archive_path.open('wb') as target:
                shutil.copyfileobj(source, target)
            with ZipFile(archive_path) as archive:
                for name in self.RAW_FILES:
                    target = self.raw / name
                    if target.is_file() and target.stat().st_size > 0:
                        continue
                    source_name = f'ml-1m/{name}'
                    if source_name not in archive.namelist():
                        raise ValueError(f'Official MovieLens ZIP is missing {source_name}')
                    staging = Path(temporary) / name
                    with archive.open(source_name) as stream, staging.open('wb') as output:
                        shutil.copyfileobj(stream, output)
                    if staging.stat().st_size == 0:
                        raise ValueError(f'Downloaded MovieLens file is empty: {name}')
                    staging.replace(target)

    def _clone_mapping(self) -> None:
        """Recover incomplete mappings without removing or overwriting existing files.

        The published ID mapping contains two small text files. Fetching missing
        files directly also works when an old clone is present but incomplete.
        """
        self.mapping.mkdir(parents=True, exist_ok=True)
        with TemporaryDirectory(prefix='sasrec-mapping-', dir=self.mapping) as temporary:
            for filename in self.MAP_FILES:
                target = self.mapping / filename
                if target.is_file() and target.stat().st_size > 0:
                    continue
                staging = Path(temporary) / filename
                url = f'{self.MAPPING_RAW_URL}/{filename}'
                with urlopen(url, timeout=60) as source, staging.open('wb') as output:
                    shutil.copyfileobj(source, output)
                # Fail before publishing a downloaded HTML error page or empty file.
                rows = staging.read_text(encoding='utf-8').splitlines()
                if not rows or any(len(row.split()) != 2 or
                                   not all(part.isdecimal() for part in row.split())
                                   for row in rows):
                    raise ValueError(f'Downloaded mapping file is invalid: {filename}')
                staging.replace(target)
