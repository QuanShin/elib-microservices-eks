FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["BorrowService/BorrowService.csproj", "BorrowService/"]
RUN dotnet restore "BorrowService/BorrowService.csproj"

COPY . .
WORKDIR /src/BorrowService
RUN dotnet publish "BorrowService.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

EXPOSE 8083
ENV ASPNETCORE_URLS=http://+:8083

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "BorrowService.dll"]