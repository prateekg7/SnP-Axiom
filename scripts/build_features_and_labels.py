import json
from pathlib import Path
import pandas as pd

from src.features.pipeline import FeaturePipeline
from src.labels.targets import compute_targets


def main():
    canonical_path = Path("data/processed/spx_5m_canonical.parquet")
    if not canonical_path.exists():
        raise FileNotFoundError(f"Canonical dataset not found at {canonical_path}")

    print(f"Loading canonical dataset from {canonical_path}...")
    df = pd.read_parquet(canonical_path)
    print(f"Loaded {len(df)} bars.")

    print("Computing features...")
    pipeline = FeaturePipeline(version="v1.0")
    features_df = pipeline.compute_features(df)
    feature_names = pipeline.get_feature_names()
    print(f"Generated {len(feature_names)} features.")

    print("Computing forward-looking targets...")
    targets_df = compute_targets(df)
    target_names = [c for c in targets_df.columns if c != "timestamp"]
    print(f"Generated {len(target_names)} targets: {target_names}")

    out_features = Path("data/processed/features.parquet")
    out_targets = Path("data/labels/targets.parquet")
    out_features.parent.mkdir(parents=True, exist_ok=True)
    out_targets.parent.mkdir(parents=True, exist_ok=True)

    features_df.to_parquet(out_features)
    targets_df.to_parquet(out_targets)
    print(f"Saved features to {out_features}")
    print(f"Saved targets to {out_targets}")

    # Save schema metadata
    schema = {
        "feature_version": "v1.0",
        "num_features": len(feature_names),
        "features": feature_names,
        "target_version": "v1.0",
        "num_targets": len(target_names),
        "targets": target_names,
        "rows": len(df),
        "earliest_timestamp": str(df["timestamp"].min()),
        "latest_timestamp": str(df["timestamp"].max()),
    }
    schema_path = Path("data/processed/feature_schema.json")
    schema_path.write_text(json.dumps(schema, indent=2))
    print(f"Saved schema metadata to {schema_path}")


if __name__ == "__main__":
    main()
