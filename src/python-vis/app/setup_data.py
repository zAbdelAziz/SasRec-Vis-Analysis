"""Usage (from src/python-vis): python -m app.setup_data"""
from app.config import Settings
from app.core.data_setup import MovieLensSetup


class DataSetupCommand:
    @staticmethod
    def main():
        print('Checking MovieLens-1M and SASRec metadata mapping...')
        for message in MovieLensSetup(Settings.from_environment()).install():
            print(message)
        print('Done. The API will independently verify ID mapping and chronology.')


if __name__ == '__main__':
    DataSetupCommand.main()
