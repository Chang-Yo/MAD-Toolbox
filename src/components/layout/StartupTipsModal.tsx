import { useEffect, useState } from "react";
import type { EmblaCarouselType } from "embla-carousel";
import { Carousel } from "@mantine/carousel";
import { ActionIcon, Button, Group, Modal, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconChevronLeft, IconChevronRight, IconFileMusic, IconNetwork } from "@tabler/icons-react";

const DISMISSED_AT_KEY = "mad-toolbox:startup-tips-dismissed-at";

function localDateKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

/** 「今日不再提醒」只在当天生效，次日启动再次弹出 */
export function isStartupTipsDismissedToday(): boolean {
  try {
    return localStorage.getItem(DISMISSED_AT_KEY) === localDateKey();
  } catch {
    return false;
  }
}

interface StartupTipsModalProps {
  opened: boolean;
  onClose: () => void;
}

/**
 * 启动提示：两页轮播，翻页箭头与操作按钮固定在底部一行。
 * 「今日不再提醒」仅在第二页可见可点，用户必须翻到末页才能当天免打扰。
 */
export function StartupTipsModal({ opened, onClose }: StartupTipsModalProps) {
  const [embla, setEmbla] = useState<EmblaCarouselType | null>(null);
  const [slide, setSlide] = useState(0);

  // Modal 关闭时内容卸载，但打开动画期间容器宽度可能尚未就绪，须 reInit 才能正确测量滑动宽度
  useEffect(() => {
    if (opened) embla?.reInit();
  }, [opened, embla]);

  const dismissForToday = () => {
    try {
      localStorage.setItem(DISMISSED_AT_KEY, localDateKey());
    } catch {
      // localStorage 不可用（隐私模式等）时退化为仅本次关闭
    }
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="使用提示"
      size={560}
      centered
      withCloseButton={false}
    >
      <Carousel
        slideSize="100%"
        height={190}
        withControls={false}
        emblaOptions={{ loop: false, watchDrag: false }}
        getEmblaApi={setEmbla}
        onSlideChange={setSlide}
      >
        <Carousel.Slide>
          <Stack gap="sm" h="100%" justify="flex-start" pt="sm" px="xl">
            <Group gap="xs">
              <ThemeIcon variant="light" color="orange" size="lg">
                <IconNetwork size={18} />
              </ThemeIcon>
              <Text fw={600}>代理开关会影响各功能页的性能</Text>
            </Group>
            <Text size="sm" c="dimmed">
              功能页的网络请求都会经过全局代理。下载音乐等使用国内音源时，关闭代理速度更快； 下载
              YouTube 等国外源时则相反。请按数据源在「设置 → 通用」中合理开关代理。
            </Text>
          </Stack>
        </Carousel.Slide>
        <Carousel.Slide>
          <Stack gap="sm" h="100%" justify="flex-start" pt="sm" px="xl">
            <Group gap="xs">
              <ThemeIcon variant="light" color="orange" size="lg">
                <IconFileMusic size={18} />
              </ThemeIcon>
              <Text fw={600}>体积偏大的 FLAC 可能是「假无损」</Text>
            </Group>
            <Text size="sm" c="dimmed">
              音乐搜索结果中体积明显偏大的无损文件，可能只是通过升高采样率把体积撑大，
              多出的体积都是无效信息。这是音源站返回的文件本身如此，工具侧无法解决，
              请结合体积与时长自行判断是否下载。
            </Text>
          </Stack>
        </Carousel.Slide>
      </Carousel>
      {/* 底部控制行：左右圆角矩形翻页箭头分居两侧，「今日不再提醒」居中且仅第二页可见。
          visibility 占位保证首屏到次页时控制行高度不跳。 */}
      <Group justify="space-between" align="center" mt="xs">
        <ActionIcon
          variant="default"
          radius="sm"
          w={44}
          h={32}
          disabled={slide === 0}
          onClick={() => embla?.scrollPrev()}
          aria-label="上一页"
        >
          <IconChevronLeft size={18} />
        </ActionIcon>
        <span style={{ visibility: slide === 1 ? "visible" : "hidden" }}>
          <Button variant="light" onClick={dismissForToday}>
            今日不再提醒
          </Button>
        </span>
        <ActionIcon
          variant="default"
          radius="sm"
          w={44}
          h={32}
          disabled={slide === 1}
          onClick={() => embla?.scrollNext()}
          aria-label="下一页"
        >
          <IconChevronRight size={18} />
        </ActionIcon>
      </Group>
    </Modal>
  );
}
