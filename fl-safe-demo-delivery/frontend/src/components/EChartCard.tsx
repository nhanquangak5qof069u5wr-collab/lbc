import { useEffect, useRef } from "react";
import * as echarts from "echarts";

interface EChartCardProps {
  title: string;
  subtitle?: string;
  option: echarts.EChartsCoreOption;
  height?: number;
}

export function EChartCard({ title, subtitle, option, height = 320 }: EChartCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    const chart = echarts.init(ref.current);
    chart.setOption(option);
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [option]);

  return (
    <section className="panel chart-card">
      <div className="panel-header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      <div ref={ref} style={{ height }} />
    </section>
  );
}
