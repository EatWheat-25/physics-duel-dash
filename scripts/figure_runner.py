"""Run one AI-written matplotlib script and also save a PNG copy of its figure.

Called by figures_pilot.py render, inside the figure's own folder, after the
script has passed the import and name checks there.
"""

import runpy
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

runpy.run_path(sys.argv[1], run_name="__main__")

nums = plt.get_fignums()
if nums:
    plt.figure(nums[0]).savefig("figure.png", dpi=110, bbox_inches="tight")
