# 指数策略日报

## 当日结论
1. **环境档位：** {{environment_label}}
2. **总权益目标：** {{allocation_plan.total_equity_target}}%
3. **今日是否调仓：** {{rebalance_plan.needs_rebalance}}
4. **最重要风险：** {{risk_flags[0]}}
5. **明天最该盯的点：** {{watch_points[0]}}

## 配置建议
- **真防守：** {{allocation_plan.true_defensive_weight}}%
- **权益防守：** {{allocation_plan.equity_defensive_weight}}%
- **核心仓：** {{allocation_plan.core_weight}}%
- **卫星仓：** {{allocation_plan.satellite_weight}}%
- **A股 / H股：** {{allocation_plan.a_share_weight}}% / {{allocation_plan.h_share_weight}}%
- **一句话总结：** {{allocation_plan.allocation_summary}}

## 调仓建议
- **动作：** {{rebalance_plan.rebalance_action}}
- **理由：** {{rebalance_plan.rebalance_reasoning}}

## 风险提示
{{#risk_flags}}
- {{.}}
{{/risk_flags}}

## 观察点
{{#watch_points}}
- {{.}}
{{/watch_points}}

## 关注基金池
{{#fund_pool_focus}}
- {{.}}
{{/fund_pool_focus}}
