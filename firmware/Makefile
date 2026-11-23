# Tests nativos sin PlatformIO (útil en CI o si `pio test -e native` no está disponible).
#   make test UNITY_DIR=/ruta/a/Unity/src
# Si no se pasa UNITY_DIR, se clona Unity en .unity/ (requiere git).
UNITY_DIR ?= .unity/src
CXX ?= g++
CC ?= gcc
CXXFLAGS ?= -std=c++11 -Wall -Wextra -Werror -O1 -g
LIB := lib/pet_protocol/src
SRCS := $(wildcard $(LIB)/*.cpp)
TESTS := $(wildcard test/test_*/test_main.cpp)
BINS := $(patsubst test/%/test_main.cpp,build/%,$(TESTS))

.PHONY: test clean
test: $(UNITY_DIR)/unity.c $(BINS)
	@set -e; for b in $(BINS); do echo "== $$b"; ./$$b; done

.unity/src/unity.c:
	git clone -q --depth 1 https://github.com/ThrowTheSwitch/Unity .unity

build/unity.o: $(UNITY_DIR)/unity.c
	@mkdir -p build
	$(CC) -O1 -c $< -o $@

build/%: test/%/test_main.cpp $(SRCS) build/unity.o
	@mkdir -p build
	$(CXX) $(CXXFLAGS) -I$(LIB) -I$(UNITY_DIR) $< $(SRCS) build/unity.o -o $@

clean:
	rm -rf build
