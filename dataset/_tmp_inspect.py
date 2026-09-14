import pandas as pd

df = pd.read_csv("weather_data_with_code.csv")
print("shape:", df.shape)
print("cols:", df.columns.tolist())
print(df.head(3).to_string())
print(df.tail(3).to_string())
d = pd.to_datetime(df["date"], utc=True, errors="coerce")
print("date dtype raw:", df["date"].dtype)
print("na dates:", d.isna().sum())
print("min:", d.min(), "max:", d.max())
print("n unique:", d.nunique())
step = d.sort_values().diff().value_counts()
print("step counts:\n", step.head(10))
print("full range expected hours:",
      int((d.max() - d.min()).total_seconds() // 3600) + 1)
print("nan counts:\n", df.isna().sum().to_string())
