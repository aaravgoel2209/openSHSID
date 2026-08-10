"""
双编码器排序模型
item_enc: 32-dim → 64-dim
user_enc: 32-dim → 64-dim
fusion:   128-dim → 64 → 32 → 1 (score in [0, 10])
heat 作为 item 向量的标量缩放，在模型外部应用
"""

import torch
import torch.nn as nn

from config_loader import cfg


def _make_encoder(in_dim: int, out_dim: int, dropout: float) -> nn.Sequential:
    return nn.Sequential(
        nn.Linear(in_dim, out_dim),
        nn.GELU(),
        nn.Dropout(dropout),
        nn.Linear(out_dim, out_dim),
        nn.GELU(),
    )


class RecoModel(nn.Module):
    def __init__(self, emb_dim: int = None, hidden: int = None, dropout: float = None):
        # 架构超参集中在 config.json 的 reco_model 段；显式传参（测试）优先
        rc = cfg['reco_model']
        emb_dim = rc['emb_dim'] if emb_dim is None else emb_dim
        hidden = rc['hidden'] if hidden is None else hidden
        dropout = rc['dropout'] if dropout is None else dropout
        super().__init__()
        self.item_enc = _make_encoder(emb_dim, hidden, dropout)
        self.user_enc = _make_encoder(emb_dim, hidden, dropout)
        self.fusion = nn.Sequential(
            nn.Linear(hidden * 2, hidden),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden, 32),
            nn.GELU(),
            nn.Linear(32, 1),
        )
        self._init_weights()
        self._print_params()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight)
                nn.init.zeros_(m.bias)

    def _fuse(self, item_vec: torch.Tensor, user_vec: torch.Tensor) -> torch.Tensor:
        item_h = self.item_enc(item_vec)
        user_h = self.user_enc(user_vec)
        return self.fusion(torch.cat([item_h, user_h], dim=-1))

    def forward(self, item_vec: torch.Tensor, user_vec: torch.Tensor) -> torch.Tensor:
        """推理接口：返回 [0, 10] 的排序分数"""
        return torch.sigmoid(self._fuse(item_vec, user_vec)) * 10.0

    def score_logit(self, item_vec: torch.Tensor, user_vec: torch.Tensor) -> torch.Tensor:
        """训练接口：返回原始 logit，供 BPR loss 使用"""
        return self._fuse(item_vec, user_vec).squeeze(-1)

    def _print_params(self):
        total = sum(p.numel() for p in self.parameters())
        print(f"[Model] RecoModel 参数量: {total:,} ({total/1024:.1f}K)")


# 兼容旧版模型名称
Model = RecoModel
