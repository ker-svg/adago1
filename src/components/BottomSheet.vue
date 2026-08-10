<template>
  <div class="bottom-sheet" :class="{ compact }">
    <div class="sheet-handle" />
    <div class="sheet-body">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  compact: {
    type: Boolean,
    default: false,
  },
})
</script>

<style scoped>
.bottom-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 600;
  max-height: 42%;
  overflow: auto;
  padding: 8px 16px 18px;
  border-radius: 28px 28px 0 0;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 -18px 48px rgba(10, 22, 40, 0.22);
  backdrop-filter: blur(10px);
}

.bottom-sheet.compact {
  max-height: 36%;
}

.sheet-handle {
  width: 42px;
  height: 5px;
  border-radius: 999px;
  background: #d7dde0;
  margin: 4px auto 12px;
}

.sheet-body {
  min-height: 0;
}

@media (min-width: 960px) {
  .bottom-sheet,
  .bottom-sheet.compact {
    position: relative;
    max-height: none;
    height: 100%;
    border-radius: 0;
    box-shadow: none;
    border-left: 1px solid #e5e7eb;
  }
}
</style>
