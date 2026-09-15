import sys

import flask
import joblib
import numpy
import pandas
import requests
import sklearn

print("python", sys.version.replace("\n", " "))
print("flask", flask.__version__)
print("requests", requests.__version__)
print("pandas", pandas.__version__)
print("numpy", numpy.__version__)
print("sklearn", sklearn.__version__)
print("joblib", joblib.__version__)

try:
    import flask_cors

    print("flask_cors AVAILABLE", flask_cors.__version__)
except ImportError as exc:
    print("flask_cors MISSING", exc)
