"""
输入: item_vec (32-dim) * heat, user_vec (32-dim) → 拼接(64-dim) → 5层FC → 0~10 float
"""

import torch
import torch.nn as nn


class Model(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(64, 128),
            nn.ReLU(),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.Linear(16, 1),
        )
        self._print_params()

    def forward(self, item_vec, user_vec):
        x = torch.cat([item_vec, user_vec], dim=-1)
        x = self.net(x)
        return torch.sigmoid(x) * 10.0

    def _print_params(self):
        total = sum(p.numel() for p in self.parameters())
        print(f"[Model] 参数量: {total:,} ({total/1024:.1f}K)")
