## 버전 관리

버전은 반드시 `package.json`과 `.claude-plugin/plugin.json` 두 곳에서 동시에 올려야 한다.
marketplace는 `plugin.json`의 version을 캐시 키로 사용하므로, 여기를 안 올리면 업데이트가 반영되지 않는다.

```bash
./scripts/bump-version.sh         # patch (1.0.10 → 1.0.11)
./scripts/bump-version.sh minor   # minor (1.0.10 → 1.1.0)
./scripts/bump-version.sh major   # major (1.0.10 → 2.0.0)
```

## 개발 환경

- 실제 플러그인 실행 경로: `~/.claude/plugins/cache/claude-statusbar/claude-statusbar/{version}/`
- bun이 TS를 직접 실행하므로 빌드 없이도 소스 수정이 즉시 반영됨 (로컬 캐시 수정 시)
- `dist/`는 node 환경용으로 커밋에 포함

## 수정 후 체크리스트

1. `npm run build` — 컴파일 에러 확인
2. `./scripts/bump-version.sh` — 버전 올리기
3. `git add . && git commit && git push`
